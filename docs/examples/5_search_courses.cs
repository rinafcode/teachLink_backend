using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class SearchCoursesExample {
    public static async Task SearchCourses() {
        using (var client = new HttpClient()) {
            client.BaseAddress = new Uri("http://localhost:3000");
            
            var response = await client.getAsync("/search");
            
            var result = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Response: " + result);
        }
    }

    public static void Main() {
        SearchCourses().Wait();
    }
}